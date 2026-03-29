import { Platform, StyleSheet } from "react-native";

const headingFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-medium",
  default: undefined
});

const bodyFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif",
  default: undefined
});

const palette = {
  primary: "#5B7CFA",
  primarySoft: "#EEF3FF",
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#162033",
  muted: "#5F6C82",
  subtle: "#8A95A7",
  border: "#E2E8F0",
  borderStrong: "#CFD8E3",
  success: "#22C55E",
  successSoft: "#E9F9EF",
  warning: "#F59E0B",
  warningSoft: "#FFF6E3",
  danger: "#EF4444",
  dangerSoft: "#FEEDEE",
  bubbleAssistant: "#EEF3FF",
  bubbleUser: "#FFFFFF",
  shadow: "#A8B6D8"
};

export const toneStyles = {
  neutral: { backgroundColor: "#F1F5F9", borderColor: palette.border },
  pending: { backgroundColor: "#F1F5F9", borderColor: palette.border },
  completed: { backgroundColor: palette.successSoft, borderColor: "#BCE9CC" },
  skipped: { backgroundColor: palette.warningSoft, borderColor: "#F7DFA7" },
  edited: { backgroundColor: palette.primarySoft, borderColor: "#D3DEFF" },
  locked: { backgroundColor: "#EEF2FF", borderColor: "#D8E0FF" },
  low: { backgroundColor: "#EEF8F1", borderColor: "#CBECD6" },
  medium: { backgroundColor: "#FFF7E6", borderColor: "#F4DFAC" },
  high: { backgroundColor: "#FFF0EE", borderColor: "#F7CCC6" },
  generating: { backgroundColor: "#EEF3FF", borderColor: "#D4E0FF" },
  delayed: { backgroundColor: "#FFF6E3", borderColor: "#F4D8A0" },
  ready: { backgroundColor: palette.successSoft, borderColor: "#BCE9CC" },
  failed: { backgroundColor: palette.dangerSoft, borderColor: "#F6C8CC" },
  required: { backgroundColor: "#EEF3FF", borderColor: "#D3DEFF" }
};

export const toneTextStyles = {
  neutral: { color: palette.muted },
  pending: { color: palette.muted },
  completed: { color: "#1D7A44" },
  skipped: { color: "#A15C00" },
  edited: { color: "#4164D3" },
  locked: { color: "#5266A8" },
  low: { color: "#237046" },
  medium: { color: "#9A6700" },
  high: { color: "#BB4B3A" },
  generating: { color: "#4664C9" },
  delayed: { color: "#B46A00" },
  ready: { color: "#1D7A44" },
  failed: { color: "#C2414F" },
  required: { color: "#4164D3" }
};

export const toneButtonStyles = {
  primary: { backgroundColor: palette.primary },
  secondary: {
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: "#D9E3FF"
  },
  ghost: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border
  },
  danger: { backgroundColor: palette.danger },
  muted: {
    backgroundColor: "#EDF2F7",
    borderWidth: 1,
    borderColor: palette.border
  }
};

export const toneButtonTextStyles = {
  primary: { color: "#FFFFFF" },
  secondary: { color: palette.primary },
  ghost: { color: palette.text },
  danger: { color: "#FFFFFF" },
  muted: { color: palette.subtle }
};

const cardShadow = {
  shadowColor: palette.shadow,
  shadowOpacity: 0.14,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 5
};

export const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  screen: {
    flex: 1,
    backgroundColor: palette.background
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject
  },
  backgroundBlobTop: {
    position: "absolute",
    top: -150,
    right: -50,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(91,124,250,0.14)"
  },
  backgroundBlobLeft: {
    position: "absolute",
    top: 220,
    left: -130,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(125,211,252,0.16)"
  },
  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(191,219,254,0.22)"
  },
  backgroundHalo: {
    position: "absolute",
    top: 80,
    left: 28,
    right: 28,
    height: 220,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.55)"
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12
  },
  loadingTitle: {
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center"
  },
  loadingCopy: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center"
  },
  welcomeContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 34,
    gap: 16,
    minHeight: "100%",
    justifyContent: "center"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 42,
    gap: 16
  },
  heroCard: {
    ...cardShadow,
    backgroundColor: palette.card,
    borderRadius: 30,
    padding: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(91,124,250,0.08)"
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4
  },
  heroTitle: {
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700"
  },
  heroCopy: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 24
  },
  heroStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: "#D7E2FF"
  },
  heroBadgeLabel: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.9
  },
  heroBadgeValue: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 3
  },
  card: {
    ...cardShadow,
    backgroundColor: palette.card,
    borderRadius: 26,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700"
  },
  mutedCopy: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22
  },
  pageEyebrow: {
    color: palette.primary,
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  pageTitle: {
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700"
  },
  pageSubtitle: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 23
  },
  greetingWrap: {
    gap: 6,
    paddingTop: 6
  },
  segmentedControl: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.74)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.95)"
  },
  segmentedItem: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 12
  },
  segmentedItemActive: {
    backgroundColor: palette.card,
    ...cardShadow,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  segmentedLabel: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  },
  segmentedLabelActive: {
    color: palette.text
  },
  fieldGroup: {
    gap: 8
  },
  formSplitRow: {
    flexDirection: "row",
    gap: 12
  },
  formSplitItem: {
    flex: 1,
    gap: 8
  },
  fieldLabel: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  promptText: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 23
  },
  helperLine: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 20
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 15
  },
  multilineInput: {
    minHeight: 118
  },
  noteCard: {
    backgroundColor: "#F8FBFF",
    borderRadius: 20,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: palette.border
  },
  noteTitle: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  noteCopy: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 21
  },
  stepRail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2
  },
  stepRailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  stepRailDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: palette.border
  },
  stepRailDotActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  stepRailDotText: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700"
  },
  stepRailDotTextActive: {
    color: "#FFFFFF"
  },
  stepRailLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#DFE7F1",
    marginHorizontal: 8
  },
  stepRailLineActive: {
    backgroundColor: palette.primary
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  choicePill: {
    maxWidth: "100%",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: palette.border
  },
  choicePillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  choicePillDisabled: {
    opacity: 0.55
  },
  choicePillText: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  },
  choicePillTextActive: {
    color: "#FFFFFF"
  },
  buttonBase: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  buttonCompact: {
    minHeight: 38,
    paddingHorizontal: 14
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }]
  },
  buttonDisabled: {
    opacity: 0.58
  },
  buttonText: {
    fontFamily: bodyFont,
    fontSize: 15,
    fontWeight: "700"
  },
  buttonTextDisabled: {
    color: palette.subtle
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricTile: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: palette.border
  },
  metricTileLabel: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  metricTileValue: {
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 6
  },
  timelineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 10
  },
  inlineActionItem: {
    flex: 1
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6
  },
  listRowCopy: {
    flex: 1,
    gap: 3
  },
  listPrimary: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700"
  },
  listSecondary: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 19
  },
  listTertiary: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 18
  },
  emptyLine: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22
  },
  goalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  goalCardTitle: {
    flex: 1,
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700"
  },
  goalCardMeta: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 21
  },
  statPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: "#D8E2FF"
  },
  statPillText: {
    color: palette.primary,
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700"
  },
  progressSummaryRow: {
    flexDirection: "row",
    gap: 12
  },
  progressStat: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 4
  },
  progressStatLabel: {
    color: palette.subtle,
    fontFamily: bodyFont,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  progressStatValue: {
    color: palette.text,
    fontFamily: headingFont,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700"
  },
  taskList: {
    gap: 12
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#F9FBFF"
  },
  taskItemDone: {
    backgroundColor: "#F6FBF7"
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7D2E5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    backgroundColor: palette.card
  },
  taskCheckboxDone: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  taskCheckboxGlyph: {
    color: "transparent",
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: "700"
  },
  taskCheckboxGlyphDone: {
    color: "#FFFFFF"
  },
  taskItemContent: {
    flex: 1,
    gap: 6
  },
  taskItemTitle: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700"
  },
  taskItemTitleDone: {
    color: palette.muted,
    textDecorationLine: "line-through"
  },
  taskItemMeta: {
    color: palette.muted,
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 19
  },
  taskItemActionRow: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 2
  },
  textLink: {
    color: palette.primary,
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: "700"
  },
  textLinkDanger: {
    color: palette.warning
  },
  taskCard: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: "#F9FBFF",
    borderWidth: 1,
    borderColor: palette.border
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  taskHeaderChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  taskTitle: {
    flex: 1,
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700"
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  taskActionStack: {
    gap: 10
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1
  },
  statusChipText: {
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700"
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4
  },
  previewWeekBadge: {
    width: 48,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D8E2FF"
  },
  previewWeekText: {
    color: palette.primary,
    fontFamily: headingFont,
    fontSize: 14,
    fontWeight: "700"
  },
  previewCopy: {
    flex: 1,
    gap: 4
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E7EEF8",
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary
  },
  coachBanner: {
    backgroundColor: palette.primarySoft,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#D6E1FF"
  },
  coachBannerText: {
    color: palette.primary,
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20
  },
  errorBanner: {
    backgroundColor: palette.dangerSoft,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#F4C9CE"
  },
  errorText: {
    color: "#C2414F",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20
  },
  busyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 4
  },
  busyText: {
    color: palette.primary,
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  },
  chatThread: {
    gap: 12
  },
  chatQuestionBlock: {
    gap: 10
  },
  chatMessageRow: {
    flexDirection: "row",
    justifyContent: "flex-start"
  },
  chatMessageRowUser: {
    justifyContent: "flex-end"
  },
  chatBubble: {
    maxWidth: "86%",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1
  },
  chatBubbleAssistant: {
    backgroundColor: palette.bubbleAssistant,
    borderColor: "#D8E3FF"
  },
  chatBubbleUser: {
    backgroundColor: palette.bubbleUser,
    borderColor: palette.border
  },
  chatBubbleText: {
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 22
  },
  chatBubbleTextUser: {
    color: palette.text
  },
  chatComposer: {
    gap: 10,
    paddingTop: 4
  },
  chatInput: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#F9FBFF",
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: palette.text,
    fontFamily: bodyFont,
    fontSize: 15
  },
  chatReplyInput: {
    backgroundColor: palette.card
  }
});
