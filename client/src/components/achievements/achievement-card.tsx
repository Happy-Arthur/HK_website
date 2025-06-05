import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Achievement {
  id: number;
  name: string;
  description: string;
  category: string;
  points: number;
  badgeUrl: string | null;
  requirement: number;
  level: number;
  isActive: boolean;
}

export interface AchievementProgress {
  userId: number;
  achievementId: number;
  currentProgress: number;
  requirement: number;
  completed: boolean;
  achievement: Achievement;
}

interface AchievementCardProps {
  achievement: AchievementProgress;
  className?: string;
}

export function AchievementCard({ achievement, className }: AchievementCardProps) {
  const { completed, currentProgress, requirement } = achievement;
  const { name, description, category, points, level, isActive } = achievement.achievement;
  
  // Calculate progress percentage
  const progressPercentage = Math.min(100, Math.round((currentProgress / requirement) * 100));
  
  // Format category for display
  const formattedCategory = category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Determine card colors based on completion state
  const cardClasses = cn(
    "relative overflow-hidden transition-all duration-300",
    completed ? "border-primary/70 bg-primary/5" : "border-muted",
    !isActive && "opacity-60",
    className
  );
  
  return (
    <Card className={cardClasses}>
      {/* Conditional locked overlay for inactive achievements */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {name}
              {completed && <Award className="h-5 w-5 text-primary" />}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">
            {formattedCategory}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Level {level}</span>
            <span className="font-medium">{points} points</span>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{currentProgress} / {requirement}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
          
          {completed && (
            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
              Completed
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}