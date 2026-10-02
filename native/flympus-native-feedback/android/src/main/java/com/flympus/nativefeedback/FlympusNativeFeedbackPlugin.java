package com.flympus.nativefeedback;

import android.media.AudioAttributes;
import android.media.SoundPool;
import android.view.HapticFeedbackConstants;
import android.view.View;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "FlympusNativeFeedback")
public class FlympusNativeFeedbackPlugin extends Plugin {
    private SoundPool soundPool;
    private int bottomNavSoundId;
    private int pullToRefreshSoundId;
    private final Set<Integer> readySounds = Collections.synchronizedSet(new HashSet<>());

    @Override
    public void load() {
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        soundPool = new SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(attributes)
            .build();

        soundPool.setOnLoadCompleteListener((pool, sampleId, status) -> {
            if (status == 0) readySounds.add(sampleId);
        });

        bottomNavSoundId = soundPool.load(getContext(), R.raw.flympus_nav_signature_10, 1);
        pullToRefreshSoundId = soundPool.load(getContext(), R.raw.flympus_refresh_sync_13, 1);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String kind = call.getString("kind", "bottomNav");
        int soundId = "pullToRefresh".equals(kind) ? pullToRefreshSoundId : bottomNavSoundId;

        if (soundPool == null || soundId == 0 || !readySounds.contains(soundId)) {
            call.reject("Native UI sound is not ready");
            return;
        }

        int streamId = soundPool.play(soundId, 1f, 1f, 1, 0, 1f);
        if (streamId == 0) {
            call.reject("Native UI sound could not start");
            return;
        }

        JSObject result = new JSObject();
        result.put("played", true);
        call.resolve(result);
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        View root = getActivity() != null && getActivity().getWindow() != null
            ? getActivity().getWindow().getDecorView()
            : null;

        if (root == null) {
            call.reject("Native haptic view is unavailable");
            return;
        }

        String style = call.getString("style", "light");
        int feedback = "heavy".equals(style)
            ? HapticFeedbackConstants.LONG_PRESS
            : ("medium".equals(style) ? HapticFeedbackConstants.CONTEXT_CLICK : HapticFeedbackConstants.CLOCK_TICK);

        boolean performed = root.performHapticFeedback(feedback);
        JSObject result = new JSObject();
        result.put("performed", performed);
        call.resolve(result);
    }
}
