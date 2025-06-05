import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarIcon,
  TrophyIcon, 
  Timer,
  Users,
  ArrowLeft
} from "lucide-react";
import { format, formatDistance } from 'date-fns';
import { Link } from 'wouter';

interface ChallengeDetailProps {
  challengeId: number;
  userId?: number;
  onBack?: () => void;
}

const ChallengeDetail: React.FC<ChallengeDetailProps> = ({ 
  challengeId,
  userId,
  onBack
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch challenge details
  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ['/api/challenges', challengeId],
    queryFn: async () => {
      const response = await fetch(`/api/challenges/${challengeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch challenge details');
      }
      return response.json();
    },
  });
  
  // Fetch user progress if logged in
  const { data: userProgress } = useQuery({
    queryKey: ['/api/challenges', challengeId, 'progress', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const response = await fetch(`/api/challenges/${challengeId}/progress`);
      if (!response.ok) {
        // Don't throw error for progress, just return null
        return null;
      }
      return response.json();
    },
    enabled: !!userId, // Only fetch when userId is available
  });
  
  // Join challenge mutation
  const joinChallenge = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be logged in to join a challenge');
      
      const response = await fetch(`/api/challenges/${challengeId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to join challenge');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Challenge joined!",
        description: `You've joined the challenge. Good luck!`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/challenges'] });
      queryClient.invalidateQueries({ queryKey: ['/api/challenges', challengeId, 'progress', userId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error joining challenge",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !challenge) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">Error loading challenge details. Please try again later.</p>
          {onBack && (
            <Button variant="outline" onClick={onBack} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const timeRemaining = formatDistance(endDate, new Date(), { addSuffix: true });
  
  const isJoined = !!userProgress;
  const progressPercentage = userProgress 
    ? Math.min(Math.round((userProgress.progress / challenge.targetValue) * 100), 100) 
    : 0;
  
  // Determine the sport badge color
  const getSportColor = (sport: string | null) => {
    if (!sport) return "bg-gray-100 text-gray-800";
    
    const sportColors: Record<string, string> = {
      basketball: "bg-orange-100 text-orange-800",
      soccer: "bg-green-100 text-green-800",
      tennis: "bg-yellow-100 text-yellow-800",
      badminton: "bg-purple-100 text-purple-800",
      swimming: "bg-blue-100 text-blue-800",
      running: "bg-red-100 text-red-800",
      fitness: "bg-indigo-100 text-indigo-800",
    };
    
    return sportColors[sport] || "bg-gray-100 text-gray-800";
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col space-y-2">
          {onBack && (
            <Button 
              variant="ghost" 
              onClick={onBack} 
              className="self-start -ml-2 -mt-2 mb-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline">
              {challenge.duration.charAt(0).toUpperCase() + challenge.duration.slice(1)}
            </Badge>
            {challenge.sportType && (
              <Badge className={getSportColor(challenge.sportType)}>
                {challenge.sportType.charAt(0).toUpperCase() + challenge.sportType.slice(1)}
              </Badge>
            )}
            {challenge.district && (
              <Badge variant="secondary">
                {challenge.district.replace('_', ' ')}
              </Badge>
            )}
            {!challenge.isPublic && (
              <Badge variant="outline">Group Challenge</Badge>
            )}
            <Badge variant="secondary" className="ml-auto">
              {challenge.points} points
            </Badge>
          </div>
          
          <CardTitle className="text-2xl">{challenge.name}</CardTitle>
          <CardDescription className="text-base">
            {challenge.description}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="text-muted-foreground" size={18} />
            <div>
              <p className="font-medium">Start Date</p>
              <p className="text-muted-foreground">{format(startDate, 'PPP')}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <CalendarIcon className="text-muted-foreground" size={18} />
            <div>
              <p className="font-medium">End Date</p>
              <p className="text-muted-foreground">{format(endDate, 'PPP')}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Timer className="text-muted-foreground" size={18} />
            <div>
              <p className="font-medium">Time Remaining</p>
              <p className="text-muted-foreground">{timeRemaining}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <TrophyIcon className="text-yellow-500" size={18} />
            <div>
              <p className="font-medium">Target</p>
              <p className="text-muted-foreground">
                {challenge.targetValue} {challenge.measureUnit}
              </p>
            </div>
          </div>
        </div>
        
        {challenge.groupId && (
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Users className="text-muted-foreground" size={18} />
              <p className="font-medium">Group Challenge</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              This challenge is specific to a group you're a member of.
            </p>
            <Link href={`/groups/${challenge.groupId}`}>
              <Button variant="link" className="p-0 h-auto mt-1">
                View Group
              </Button>
            </Link>
          </div>
        )}
        
        {isJoined && (
          <div className="pt-4 border-t">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Your Progress</h3>
                <p className="text-sm font-medium">
                  {userProgress?.progress || 0} / {challenge.targetValue} {challenge.measureUnit}
                </p>
              </div>
              <Progress value={progressPercentage} className="h-2.5" />
              <p className="text-sm text-muted-foreground">
                {progressPercentage}% complete
              </p>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-6">
        {challenge.isActive ? (
          !isJoined ? (
            <Button 
              className="w-full" 
              onClick={() => joinChallenge.mutate()}
              disabled={joinChallenge.isPending || !userId}
            >
              {joinChallenge.isPending ? "Joining..." : "Join Challenge"}
            </Button>
          ) : (
            <div className="w-full text-center">
              <p className="text-green-600 font-medium mb-2">You've joined this challenge!</p>
              <p className="text-sm text-muted-foreground">
                Keep going to reach your target and earn {challenge.points} points!
              </p>
            </div>
          )
        ) : (
          <div className="w-full text-center">
            <p className="text-muted-foreground font-medium">
              This challenge has ended
            </p>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ChallengeDetail;