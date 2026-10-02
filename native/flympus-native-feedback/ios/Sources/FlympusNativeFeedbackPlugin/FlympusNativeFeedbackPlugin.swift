import Foundation
import Capacitor
import AudioToolbox
import UIKit

@objc(FlympusNativeFeedbackPlugin)
public class FlympusNativeFeedbackPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlympusNativeFeedbackPlugin"
    public let jsName = "FlympusNativeFeedback"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise)
    ]

    private var bottomNavSound: SystemSoundID = 0
    private var pullToRefreshSound: SystemSoundID = 0

    override public func load() {
        bottomNavSound = makeSystemSound(resource: "flympus-nav-signature-10")
        pullToRefreshSound = makeSystemSound(resource: "flympus-refresh-sync-13")
    }

    deinit {
        if bottomNavSound != 0 { AudioServicesDisposeSystemSoundID(bottomNavSound) }
        if pullToRefreshSound != 0 { AudioServicesDisposeSystemSoundID(pullToRefreshSound) }
    }

    private func makeSystemSound(resource: String) -> SystemSoundID {
        guard let url = Bundle.module.url(forResource: resource, withExtension: "wav") else { return 0 }
        var soundID: SystemSoundID = 0
        let status = AudioServicesCreateSystemSoundID(url as CFURL, &soundID)
        return status == kAudioServicesNoError ? soundID : 0
    }

    @objc func play(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "bottomNav"
        let soundID = kind == "pullToRefresh" ? pullToRefreshSound : bottomNavSound
        guard soundID != 0 else {
            call.reject("Native UI sound is unavailable")
            return
        }

        DispatchQueue.main.async {
            AudioServicesPlaySystemSound(soundID)
            call.resolve(["played": true])
        }
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle
        switch style {
        case "heavy": feedbackStyle = .heavy
        case "medium": feedbackStyle = .medium
        default: feedbackStyle = .light
        }

        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: feedbackStyle)
            generator.prepare()
            generator.impactOccurred()
            call.resolve(["performed": true])
        }
    }
}
