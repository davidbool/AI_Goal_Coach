import { Platform, StyleSheet } from "react-native";

const headingFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-condensed",
  default: undefined
});

const bodyFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif",
  default: undefined
});

const accentFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: undefined
});

export const toneStyles = {
  neutral: { backgroundColor: "#F2E8D9", borderColor: "#E6D7BE" },
  pending: { backgroundColor: "#F2E8D9", borderColor: "#E6D7BE" },
  completed: { backgroundColor: "#D9F0E2", borderColor: "#B4D7C4" },
  skipped: { backgroundColor: "#F7E3DB", borderColor: "#E5C3B4" },
  low: { backgroundColor: "#DCEEDB", borderColor: "#BDD8BC" },
  medium: { backgroundColor: "#F5E4BC", borderColor: "#E7CC85" },
  high: { backgroundColor: "#F7D7C9", borderColor: "#E7B7A4" },
  generating: { backgroundColor: "#E9E3F7", borderColor: "#CEC2E8" },
  delayed: { backgroundColor: "#FDE6C9", borderColor: "#F1C98A" },
  ready: { backgroundColor: "#D9F0E2", borderColor: "#B4D7C4" },
  failed: { backgroundColor: "#F7D7D0", borderColor: "#E7AEA3" },
  required: { backgroundColor: "#E2EEF8", borderColor: "#BED5EA" }
};

export const toneTextStyles = {
  neutral: { color: "#5F5349" },
  pending: { color: "#5F5349" },
  completed: { color: "#2D6950" },
  skipped: { color: "#8A4E38" },
  low: { color: "#35684A" },
  medium: { color: "#7A5A11" },
  high: { color: "#8C4727" },
  generating: { color: "#5D4A84" },
  delayed: { color: "#925E00" },
  ready: { color: "#2D6950" },
  failed: { color: "#8B3E31" },
  required: { color: "#355C7A" }
};

export const toneButtonStyles = {
  primary: { backgroundColor: "#B65C3A" },
  secondary: { backgroundColor: "#F1E4D1" },
  ghost: { backgroundColor: "#FFF8EE", borderWidth: 1, borderColor: "#E9DCC9" },
  danger: { backgroundColor: "#8F3E2B" },
  muted: { backgroundColor: "#E9E0D6" }
};

export const toneButtonTextStyles = {
  primary: { color: "#FFF7EE" },
  secondary: { color: "#3F342C" },
  ghost: { color: "#7E5A47" },
  danger: { color: "#FFF7EE" },
  muted: { color: "#8A7D70" }
};

export const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFF7EE"
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject
  },
  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#F1C37B"
  },
  backgroundBlobLeft: {
    position: "absolute",
    top: 220,
    left: -110,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#B8DCC9"
  },
  backgroundBlobBottom: {
    position: "absolute",
    bottom: -110,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#EFC4B0"
  },
  backgroundHalo: {
    position: "absolute",
    top: 80,
    left: 28,
    right: 28,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 12
  },
  loadingTitle: {
    color: "#332C27",
    fontFamily: headingFont,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center"
  },
  loadingCopy: {
    color: "#675C54",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: bodyFont
  },
  welcomeContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 18,
    minHeight: "100%",
    justifyContent: "center"
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 18
  },
  heroCard: {
    backgroundColor: "#26201D",
    borderRadius: 32,
    padding: 24,
    gap: 10,
    shadowColor: "#1A1613",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6
  },
  eyebrow: {
    color: "#F1C37B",
    fontFamily: accentFont,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2
  },
  heroTitle: {
    color: "#FFF7EE",
    fontFamily: headingFont,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700"
  },
  heroCopy: {
    color: "#E8DDD2",
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 23
  },
  heroStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,247,238,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,247,238,0.12)"
  },
  heroBadgeLabel: {
    color: "#D8C6B7",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: bodyFont
  },
  heroBadgeValue: {
    color: "#FFF7EE",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    fontFamily: bodyFont
  },
  card: {
    backgroundColor: "rgba(255, 252, 247, 0.9)",
    borderRadius: 28,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(77, 60, 49, 0.08)"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    color: "#332C27",
    fontFamily: headingFont,
    fontSize: 24,
    fontWeight: "700"
  },
  mutedCopy: {
    color: "#6C6057",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22
  },
  fieldGroup: {
    gap: 8
  },
  fieldLabel: {
    color: "#554941",
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  promptText: {
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 15,
    lineHeight: 22
  },
  helperLine: {
    color: "#7D6F66",
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 20
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7D8C5",
    backgroundColor: "#FFF8F1",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 15
  },
  multilineInput: {
    minHeight: 126
  },
  noteCard: {
    backgroundColor: "#F8EBDD",
    borderRadius: 20,
    padding: 14,
    gap: 6
  },
  noteTitle: {
    color: "#5E4736",
    fontFamily: accentFont,
    fontSize: 14
  },
  noteCopy: {
    color: "#6B5649",
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 20
  },
  stepRail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  stepRailItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  stepRailDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4E8DA",
    borderWidth: 1,
    borderColor: "#E4D6C5"
  },
  stepRailDotActive: {
    backgroundColor: "#B65C3A",
    borderColor: "#B65C3A"
  },
  stepRailDotText: {
    color: "#6D5D52",
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: "700"
  },
  stepRailDotTextActive: {
    color: "#FFF7EE"
  },
  stepRailLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E6D7C4",
    marginHorizontal: 8
  },
  stepRailLineActive: {
    backgroundColor: "#D58A66"
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
    backgroundColor: "#F6EFE6",
    borderWidth: 1,
    borderColor: "#E8DBCC"
  },
  choicePillActive: {
    backgroundColor: "#26201D",
    borderColor: "#26201D"
  },
  choicePillDisabled: {
    opacity: 0.55
  },
  choicePillText: {
    color: "#4A3F38",
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  },
  choicePillTextActive: {
    color: "#FFF7EE"
  },
  buttonBase: {
    minHeight: 48,
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
    opacity: 0.86,
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
    color: "#8C7E71"
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
    backgroundColor: "#FFF5E9",
    borderWidth: 1,
    borderColor: "#EADBC8"
  },
  metricTileLabel: {
    color: "#7B6C61",
    fontFamily: bodyFont,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase"
  },
  metricTileValue: {
    color: "#332C27",
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
    paddingVertical: 4
  },
  listRowCopy: {
    flex: 1,
    gap: 3
  },
  listPrimary: {
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 15,
    fontWeight: "700"
  },
  listSecondary: {
    color: "#6D6057",
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 19
  },
  listTertiary: {
    color: "#7D7067",
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 18
  },
  emptyLine: {
    color: "#6D6057",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 22
  },
  taskCard: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#EBDCC9"
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  taskTitle: {
    flex: 1,
    color: "#332C27",
    fontFamily: bodyFont,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    backgroundColor: "#F8EBDD",
    alignItems: "center",
    justifyContent: "center"
  },
  previewWeekText: {
    color: "#7A5B47",
    fontFamily: headingFont,
    fontSize: 14,
    fontWeight: "700"
  },
  previewCopy: {
    flex: 1,
    gap: 4
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F2E5D7",
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#B65C3A"
  },
  coachBanner: {
    backgroundColor: "#F8EBDD",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#ECD7BE"
  },
  coachBannerText: {
    color: "#5D4B3E",
    fontFamily: bodyFont,
    fontSize: 14,
    lineHeight: 20
  },
  errorBanner: {
    backgroundColor: "#FCE2D9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#EDC0B0"
  },
  errorText: {
    color: "#8A3D28",
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
    color: "#5D4B3E",
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: "700"
  }
});
