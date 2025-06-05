import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { CalendarIcon, TrophyIcon, Timer } from "lucide-react";
import { formatDistance } from 'date-fns';

export interface Challenge {
  id: number;
  name: string;
  description: string;
  type: string;
  duration: string;
  sportType: string | null;
  district: string | null;
  targetValue: number;
  measureUnit: string;
  startDate: string;
  endDate: string;
  points: number;
  isActive: boolean;
  groupId: number | null;
  isPublic: boolean;
  progress?: number; // Only available for joined challenges
  isJoined?: boolean;
}

interface ChallengeCardProps {
  challenge: Challenge;
  userId?: number;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, userId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isJoined, setIsJoined] = useState(challenge.isJoined || false);
  
  // Format dates for display
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const timeRemaining = formatDistance(endDate, new Date(), { addSuffix: true });
  
  const joinChallenge = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be logged in to join a challenge');
      
      const response = await fetch(`/api/challenges/${challenge.id}/join`, {
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
        description: `You've joined the "${challenge.name}" challenge. Good luck!`,
      });
      setIsJoined(true);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/challenges'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/challenges'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error joining challenge",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleJoinChallenge = () => {
    joinChallenge.mutate();
  };
  
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
  
  // Calculate progress percentage (if the user has joined)
  const progressPercentage = challenge.progress !== undefined 
    ? Math.min(Math.round((challenge.progress / challenge.targetValue) * 100), 100)
    : 0;
  
  return (
    <Card className={`shadow-sm hover:shadow-md transition-shadow ${!challenge.isActive ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{challenge.name}</CardTitle>
            <CardDescription className="mt-1">{challenge.description}</CardDescription>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Badge variant="outline" className="font-medium">
              {challenge.duration.charAt(0).toUpperCase() + challenge.duration.slice(1)}
            </Badge>
            {challenge.sportType && (
              <Badge className={`${getSportColor(challenge.sportType)}`}>
                {challenge.sportType.charAt(0).toUpperCase() + challenge.sportType.slice(1)}
              </Badge>
            )}
            {!challenge.isPublic && (
              <Badge variant="secondary">Group Challenge</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <CalendarIcon size={16} />
              <span>
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Timer size={16} />
              <span>{timeRemaining}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <TrophyIcon size={18} className="text-yellow-500" />
            <span className="font-medium">
              Target: {challenge.targetValue} {challenge.measureUnit}
            </span>
            <Badge variant="outline" className="ml-auto font-bold">
              {challenge.points} pts
            </Badge>
          </div>
          
          {isJoined && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Your progress</span>
                <span>{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        {challenge.isActive ? (
          isJoined ? (
            <Button variant="outline" className="w-full" disabled>
              Joined
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={handleJoinChallenge}
              disabled={joinChallenge.isPending || !userId}
            >
              {joinChallenge.isPending ? "Joining..." : "Join Challenge"}
            </Button>
          )
        ) : (
          <Button variant="outline" className="w-full" disabled>
            Expired
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ChallengeCard;