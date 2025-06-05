import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ChallengeCard, { Challenge } from "../challenges/challenge-card";
import { useAuth } from '@/hooks/use-auth';

interface ChallengesListProps {
  filter: 'all' | 'group';
  groupId?: number;
}

const ChallengesList: React.FC<ChallengesListProps> = ({ filter, groupId }) => {
  const { user } = useAuth();
  
  // Fetch challenges based on filter
  const { data: challenges, isLoading, error } = useQuery({
    queryKey: filter === 'group' && groupId 
      ? ['/api/challenges', 'group', groupId] 
      : ['/api/challenges'],
    queryFn: async () => {
      const endpoint = filter === 'group' && groupId 
        ? `/api/challenges/group/${groupId}` 
        : '/api/challenges';
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch challenges');
      }
      return response.json();
    },
    enabled: filter !== 'group' || !!groupId, // Only fetch group challenges when groupId is provided
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex items-center justify-between mt-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
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
          <p className="text-red-500">Error loading challenges. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  if (!challenges || challenges.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {filter === 'group' 
              ? 'No group challenges available.' 
              : 'No challenges available at the moment.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {challenges.map((challenge: any) => (
        <ChallengeCard 
          key={challenge.id} 
          challenge={challenge}
          userId={user?.id}
        />
      ))}
    </div>
  );
};

export default ChallengesList;