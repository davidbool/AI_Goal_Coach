import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import { ActionButton, ErrorBanner, HeroBadge, HeroPanel } from "../components/Primitives.js";
import { styles } from "../../../ui/styles.js";

export function WelcomeScreen({
  apiBaseUrl,
  busyLabel,
  errorMessage,
  onChangeApiBaseUrl,
  onContinue
}) {
  const isBusy = busyLabel.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.welcomeContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroPanel
          eyebrow="AI Goal Coach"
          title="Calm daily coaching for one meaningful goal."
          copy="This Expo build starts in guest mode so we can validate the mobile flow quickly. Set one goal, let the AI create a realistic plan, and keep the interface focused on what matters today."
        >
          <View style={styles.heroStatRow}>
            <HeroBadge label="Theme" value="Bright / clear" />
            <HeroBadge label="Mode" value="Guest preview" />
          </View>
        </HeroPanel>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Continue as a guest</Text>
          <Text style={styles.mutedCopy}>
            We will create a local guest session on this device and seed a clean coaching state so the onboarding and plan screens are ready right away.
          </Text>
          <Text style={styles.fieldLabel}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={onChangeApiBaseUrl}
            placeholder="http://127.0.0.1:3000"
            placeholderTextColor="#8A95A7"
            style={styles.input}
            value={apiBaseUrl}
          />
          <Text style={styles.helperLine}>
            Use `127.0.0.1` for the iOS Simulator when the API is running locally.
          </Text>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <ActionButton
            disabled={isBusy}
            label={isBusy ? busyLabel : "Open my coach"}
            onPress={onContinue}
            tone="primary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
