import prisma from '../services/prisma';

// ============================================
// TYPES
// ============================================

export interface CreateCommentData {
  episodeId: number;
  userId: number;
  content: string;
  parentId?: number; // For replies
}

export interface UpdateCommentData {
  content?: string;
  isPinned?: boolean;
  isHidden?: boolean;
}

// ============================================
// CREATE
// ============================================

export const createComment = async (data: CreateCommentData) => {
  console.log('[Comment Repository] Creating comment for episode:', data.episodeId);

  const comment = await prisma.comment.create({
    data: {
      episodeId: data.episodeId,
      userId: data.userId,
      content: data.content,
      parentId: data.parentId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
    },
  });

  // Update episode comment count
  await prisma.episode.update({
    where: { id: data.episodeId },
    data: { commentsCount: { increment: 1 } },
  });

  // If this is a reply, update parent's reply count
  if (data.parentId) {
    await prisma.comment.update({
      where: { id: data.parentId },
      data: { repliesCount: { increment: 1 } },
    });
  }

  return comment;
};

// ============================================
// READ
// ============================================

export const findCommentById = async (id: number) => {
  return prisma.comment.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
      _count: {
        select: {
          likes: true,
          replies: true,
        },
      },
    },
  });
};

export const findCommentsByEpisode = async (
  episodeId: number,
  limit: number = 20,
  offset: number = 0,
  sortBy: 'newest' | 'oldest' | 'popular' = 'newest'
) => {
  const orderBy: any = {
    newest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    popular: { likesCount: 'desc' },
  };

  // Get top-level comments only (no parentId)
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: {
        episodeId,
        parentId: null,
        isHidden: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            photo: true,
          },
        },
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
      },
      orderBy: [
        { isPinned: 'desc' }, // Pinned comments first
        orderBy[sortBy],
      ],
      skip: offset,
      take: limit,
    }),
    prisma.comment.count({
      where: {
        episodeId,
        parentId: null,
        isHidden: false,
      },
    }),
  ]);

  return { comments, total, limit, offset };
};

export const findReplies = async (
  parentId: number,
  limit: number = 10,
  offset: number = 0
) => {
  const [replies, total] = await Promise.all([
    prisma.comment.findMany({
      where: {
        parentId,
        isHidden: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            photo: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first for replies
      skip: offset,
      take: limit,
    }),
    prisma.comment.count({
      where: {
        parentId,
        isHidden: false,
      },
    }),
  ]);

  return { replies, total, limit, offset };
};

export const findUserComments = async (
  userId: number,
  limit: number = 20,
  offset: number = 0
) => {
  return prisma.comment.findMany({
    where: {
      userId,
      isHidden: false,
    },
    include: {
      episode: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          series: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      _count: {
        select: {
          likes: true,
          replies: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
  });
};

// ============================================
// UPDATE
// ============================================

export const updateComment = async (id: number, data: UpdateCommentData) => {
  console.log('[Comment Repository] Updating comment:', id);

  return prisma.comment.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          photo: true,
        },
      },
    },
  });
};

export const pinComment = async (id: number) => {
  return updateComment(id, { isPinned: true });
};

export const unpinComment = async (id: number) => {
  return updateComment(id, { isPinned: false });
};

export const hideComment = async (id: number) => {
  return updateComment(id, { isHidden: true });
};

// ============================================
// LIKES
// ============================================

export const toggleCommentLike = async (commentId: number, userId: number): Promise<boolean> => {
  const existingLike = await prisma.commentLike.findUnique({
    where: {
      userId_commentId: { userId, commentId },
    },
  });

  if (existingLike) {
    // Remove like
    await prisma.commentLike.delete({
      where: { id: existingLike.id },
    });
    await prisma.comment.update({
      where: { id: commentId },
      data: { likesCount: { decrement: 1 } },
    });
    return false;
  } else {
    // Add like
    await prisma.commentLike.create({
      data: { userId, commentId },
    });
    await prisma.comment.update({
      where: { id: commentId },
      data: { likesCount: { increment: 1 } },
    });
    return true;
  }
};

export const hasUserLikedComment = async (commentId: number, userId: number): Promise<boolean> => {
  const like = await prisma.commentLike.findUnique({
    where: {
      userId_commentId: { userId, commentId },
    },
  });
  return !!like;
};

// ============================================
// DELETE
// ============================================

export const deleteComment = async (id: number) => {
  console.log('[Comment Repository] Deleting comment:', id);

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      episodeId: true,
      parentId: true,
      _count: {
        select: { replies: true },
      },
    },
  });

  if (!comment) return null;

  // Delete comment (replies will cascade delete)
  await prisma.comment.delete({
    where: { id },
  });

  // Update episode comment count (including replies)
  const deletedCount = 1 + comment._count.replies;
  await prisma.episode.update({
    where: { id: comment.episodeId },
    data: { commentsCount: { decrement: deletedCount } },
  });

  // If this was a reply, update parent's reply count
  if (comment.parentId) {
    await prisma.comment.update({
      where: { id: comment.parentId },
      data: { repliesCount: { decrement: 1 } },
    });
  }

  return { deleted: true, deletedCount };
};

// ============================================
// EXPORTS
// ============================================

export default {
  createComment,
  findCommentById,
  findCommentsByEpisode,
  findReplies,
  findUserComments,
  updateComment,
  pinComment,
  unpinComment,
  hideComment,
  toggleCommentLike,
  hasUserLikedComment,
  deleteComment,
};
