export const communityPostCategories = [
  "announcement",
  "question",
  "farming_tip",
  "marketplace_update",
  "general_discussion",
] as const;

export type CommunityPostCategory = (typeof communityPostCategories)[number];

export const communityPostCategoryOptions: Array<{
  value: CommunityPostCategory;
  label: string;
  description: string;
}> = [
  {
    value: "announcement",
    label: "Announcement",
    description: "Important news or information for the Community.",
  },
  {
    value: "question",
    label: "Question",
    description: "Ask other AgriLink members for help or advice.",
  },
  {
    value: "farming_tip",
    label: "Farming tip",
    description: "Share practical knowledge and farming experience.",
  },
  {
    value: "marketplace_update",
    label: "Marketplace update",
    description: "Share product, stock, price, or order information.",
  },
  {
    value: "general_discussion",
    label: "General discussion",
    description: "Start a conversation with the AgriLink Community.",
  },
];

export const communityPostCategoryLabels: Record<CommunityPostCategory, string> =
  Object.fromEntries(
    communityPostCategoryOptions.map((option) => [option.value, option.label]),
  ) as Record<CommunityPostCategory, string>;
