export const communityPostCategories = [
  "announcement",
  "question",
  "farming_tip",
  "marketplace_update",
  "general_discussion",
] as const;

export type CommunityPostCategory = (typeof communityPostCategories)[number];

export const communityCategoryRoles: Record<CommunityPostCategory, readonly string[]> = {
  announcement: ["Management", "Marketer"],
  question: ["Management", "Marketer", "Accounting", "Farmer"],
  farming_tip: ["Management", "Marketer", "Farmer"],
  marketplace_update: ["Management", "Marketer", "Accounting"],
  general_discussion: ["Management", "Marketer", "Accounting", "Farmer"],
};

export function communityCategoriesForRoles(roles: string[]) {
  return communityPostCategories.filter((category) =>
    communityCategoryRoles[category].some((role) => roles.includes(role)),
  );
}

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
