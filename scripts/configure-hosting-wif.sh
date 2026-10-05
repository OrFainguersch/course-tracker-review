#!/usr/bin/env bash
# Run only with an authorized project administrator's gcloud session.
# Creates no keys. Do not run firebase login:ci or add a JSON-key fallback.
set -euo pipefail
project=flympus
project_number=272914048311
pool=github-hosting
provider=github
account=flympus-hosting-deployer@flympus.iam.gserviceaccount.com
repository=OrFainguersch/course-tracker-review
repository_id=1393810184
owner_id=335200333
actual_number=$(gcloud projects describe "$project" --format='value(projectNumber)')
[[ "$actual_number" == "$project_number" ]] || { echo 'Unexpected Google project number'; exit 1; }

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com firebasehosting.googleapis.com --project="$project"
if ! gcloud iam service-accounts describe "$account" --project="$project" >/dev/null 2>&1; then
  gcloud iam service-accounts create flympus-hosting-deployer --project="$project" --display-name='FLYMPUS Hosting deployment only'
fi
existing_roles=$(gcloud projects get-iam-policy "$project" --flatten='bindings[].members' --filter="bindings.members:serviceAccount:$account" --format='value(bindings.role)')
while IFS= read -r role; do
  case "$role" in
    ''|roles/firebasehosting.admin|roles/serviceusage.apiKeysViewer) ;;
    *) echo "Dedicated account has unexpected project role: $role. Review before proceeding."; exit 1 ;;
  esac
done <<< "$existing_roles"
for role in roles/firebasehosting.admin roles/serviceusage.apiKeysViewer; do
  gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$account" --role="$role" --condition=None >/dev/null
done
if ! gcloud iam workload-identity-pools describe "$pool" --project="$project" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$pool" --project="$project" --location=global --display-name='FLYMPUS GitHub Hosting'
fi
mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id'
condition="assertion.repository == '$repository' && assertion.repository_id == '$repository_id' && assertion.repository_owner_id == '$owner_id' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '$repository/.github/workflows/firebase-hosting.yml@refs/heads/main'"
if gcloud iam workload-identity-pools providers describe "$provider" --project="$project" --location=global --workload-identity-pool="$pool" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$provider" --project="$project" --location=global --workload-identity-pool="$pool" --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping="$mapping" --attribute-condition="$condition"
else
  gcloud iam workload-identity-pools providers create-oidc "$provider" --project="$project" --location=global --workload-identity-pool="$pool" --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping="$mapping" --attribute-condition="$condition"
fi
gcloud iam service-accounts add-iam-policy-binding "$account" --project="$project" --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/$project_number/locations/global/workloadIdentityPools/$pool/attribute.repository_id/$repository_id" >/dev/null
# These are public identifiers, not credentials. Verify cloud configuration
# before setting them in GitHub; do not imply provisioning from this output alone.
gcloud iam workload-identity-pools providers describe "$provider" --project="$project" --location=global --workload-identity-pool="$pool" --format='yaml(name,state,oidc.issuerUri,attributeMapping,attributeCondition)'
gcloud iam service-accounts get-iam-policy "$account" --project="$project"
gcloud projects get-iam-policy "$project" --flatten='bindings[].members' --filter="bindings.members:serviceAccount:$account" --format='table(bindings.role)'
printf 'FIREBASE_WIF_PROVIDER=projects/%s/locations/global/workloadIdentityPools/%s/providers/%s\n' "$project_number" "$pool" "$provider"
printf 'FIREBASE_DEPLOY_SERVICE_ACCOUNT=%s\n' "$account"
