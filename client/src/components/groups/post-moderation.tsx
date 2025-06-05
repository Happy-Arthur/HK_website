import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, AlertTriangle, MessageSquare, Edit } from "lucide-react";
import { format } from "date-fns";

// Types
type Post = {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  imageUrl: string | null;
  sportType: string | null;
  likes: number;
  userLiked?: boolean;
  comments?: Comment[];
};

type Comment = {
  id: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  postId: number;
};

interface PostModerationProps {
  groupId: number;
  posts: Post[];
  isLoading: boolean;
}

export function PostModeration({ groupId, posts, isLoading }: PostModerationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await apiRequest("DELETE", `/api/groups/${groupId}/posts/${postId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post deleted",
        description: "The post has been removed from the group.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post.",
        variant: "destructive",
      });
    },
  });

  // Edit post mutation
  const editPostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const response = await apiRequest("PUT", `/api/groups/${groupId}/posts/${postId}`, { content });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post updated",
        description: "The post has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
      setEditPostId(null);
      setEditedContent("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update post.",
        variant: "destructive",
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      const response = await apiRequest("DELETE", `/api/posts/${postId}/comments/${commentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment.",
        variant: "destructive",
      });
    },
  });

  // Handle post deletion click
  const handleDeletePost = (postId: number) => {
    setPostToDelete(postId);
    setDeleteDialogOpen(true);
  };

  // Handle post edit click
  const handleEditPost = (post: Post) => {
    setEditPostId(post.id);
    setEditedContent(post.content);
  };

  // Handle delete comment click
  const handleDeleteComment = (postId: number, commentId: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this comment?");
    if (confirmed) {
      deleteCommentMutation.mutate({ postId, commentId });
    }
  };

  // Handle submit edit
  const handleSubmitEdit = () => {
    if (!editPostId) return;
    if (!editedContent.trim()) {
      toast({
        title: "Error",
        description: "Post content cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    editPostMutation.mutate({ postId: editPostId, content: editedContent });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center p-8">
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">No posts to moderate</h3>
        <p className="text-muted-foreground">There are no posts in this group yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Post Moderation</h2>
      <p className="text-muted-foreground">
        As an admin, you can edit or delete posts and comments that violate group guidelines.
      </p>

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{post.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4">
                    <CardTitle className="text-md">{post.username}</CardTitle>
                    <CardDescription>
                      {format(new Date(post.createdAt), "PPp")}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEditPost(post)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editPostId === post.id ? (
                <div className="space-y-4">
                  <Textarea 
                    value={editedContent} 
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setEditPostId(null);
                        setEditedContent("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmitEdit}
                      disabled={editPostMutation.isPending}
                    >
                      {editPostMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="whitespace-pre-line">{post.content}</p>
                  {post.imageUrl && (
                    <img 
                      src={post.imageUrl} 
                      alt="Post attachment" 
                      className="mt-4 rounded-md max-h-96 object-contain" 
                    />
                  )}
                  <div className="flex items-center mt-4 text-sm text-muted-foreground">
                    <span>{post.likes} {post.likes === 1 ? "Like" : "Likes"}</span>
                    <span className="mx-2">•</span>
                    <span>{post.comments?.length || 0} {post.comments?.length === 1 ? "Comment" : "Comments"}</span>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Comments Section */}
            {post.comments && post.comments.length > 0 && editPostId !== post.id && (
              <CardFooter className="flex flex-col items-start">
                <h4 className="text-sm font-medium mb-2">Comments</h4>
                <div className="space-y-4 w-full">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2 w-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-md px-3 py-2 flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-sm">{comment.username}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(comment.createdAt), "PPp")}
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => handleDeleteComment(post.id, comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 pt-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">
              Deleting this post will remove it and all associated comments permanently.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => postToDelete && deletePostMutation.mutate(postToDelete)}
              disabled={deletePostMutation.isPending}
            >
              {deletePostMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}