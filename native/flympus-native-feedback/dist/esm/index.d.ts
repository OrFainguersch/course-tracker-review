export interface FlympusNativeFeedbackPlugin {
  play(options: { kind: 'bottomNav' | 'pullToRefresh' }): Promise<{ played: boolean }>;
  haptic(options: { style?: 'light' | 'medium' | 'heavy' }): Promise<{ performed: boolean }>;
}

export declare const FlympusNativeFeedback: FlympusNativeFeedbackPlugin;
