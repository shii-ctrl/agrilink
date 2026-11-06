type CommunityPostState = {
  authorId: string;
  category: string;
  questionStatus: string;
};

export function canPinCommunityPost(roles: string[], category: string) {
  return (
    roles.includes("Management") || (roles.includes("Marketer") && category === "announcement")
  );
}

export function communityCommentsClosed(
  post: Pick<CommunityPostState, "category" | "questionStatus">,
) {
  return post.category === "question" && post.questionStatus === "resolved";
}

export function assertQuestionStatusChange(
  viewer: { id: string; roles: string[] },
  post: CommunityPostState,
  nextStatus: string,
) {
  if (post.category !== "question") throw new Error("This is not a Question post.");
  if (viewer.roles.includes("Management")) return;
  if (communityCommentsClosed(post) || nextStatus === "resolved") {
    throw new Error("Only Management can resolve or reopen a resolved question.");
  }
  if (post.authorId !== viewer.id) {
    throw new Error("Only Management or the question author can update its answer status.");
  }
}
