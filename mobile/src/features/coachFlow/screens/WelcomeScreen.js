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
          title="Turn a long-term goal into a calmer daily rhythm."
          copy="This first mobile pass runs in guest mode so we can validate the iOS flow quickly. Start here, shape one goal, and let the coach build a realistic first plan."
        >
          <View style={styles.heroStatRow}>
            <HeroBadge label="Mode" value="Guest / local" />
            <HeroBadge label="Platform" value="iOS-first" />
          </View>
        </HeroPanel>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Continue as a guest</Text>
          <Text style={styles.mutedCopy}>
            We will create a guest user on this device, keep its ID in local storage, and seed a clean starter state so the full intake flow is ready.
          </Text>
          <Text style={styles.fieldLabel}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={onChangeApiBaseUrl}
            placeholder="http://127.0.0.1:3000"
            placeholderTextColor="#8B7E73"
            style={styles.input}
            value={apiBaseUrl}
          />
          <Text style={styles.helperLine}>
            Use `127.0.0.1` for the iOS Simulator when the API is running locally.
          </Text>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
          <ActionButton
            disabled={isBusy}
            label={isBusy ? busyLabel : "Continue"}
            onPress={onContinue}
            tone="primary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
