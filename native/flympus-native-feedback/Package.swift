// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlympusNativeFeedback",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "FlympusNativeFeedback", targets: ["FlympusNativeFeedbackPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.5.2")
    ],
    targets: [
        .target(
            name: "FlympusNativeFeedbackPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/FlympusNativeFeedbackPlugin",
            resources: [.process("Resources")]
        )
    ]
)
