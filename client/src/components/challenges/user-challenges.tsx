import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ChallengeCard, { Challenge } from "../challenges/challenge-card";

interface UserChallengesProps {
  userId?: number;
}

const UserChallenges: React.FC<UserChallengesProps> = ({ userId }) => {
  // Fetch user challenges
  const { data: userChallenges, isLoading, error } = useQuery({
    queryKey: ['/api/user/challenges', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const response = await fetch(`/api/user/challenges`);
      if (!response.ok) {
        throw new Error('Failed to fetch user challenges');
      }
      return response.json();
    },
    enabled: !!userId, // Only fetch when userId is available
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center justify-between mt-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">Error loading your challenges. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  if (!userChallenges || userChallenges.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">You haven't joined any challenges yet.</p>
          <p className="text-sm mt-2">
            Explore the "All Challenges" tab to find challenges you'd like to participate in.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {userChallenges.map((challenge: any) => (
        <ChallengeCard 
          key={challenge.id} 
          challenge={{...challenge, isJoined: true}}
          userId={userId}
        />
      ))}
    </div>
  );
};

export default UserChallenges;