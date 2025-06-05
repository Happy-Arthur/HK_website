import React from 'react';
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChallengesList from "../components/challenges/challenges-list";
import UserChallenges from "../components/challenges/user-challenges";
import { useAuth } from '@/hooks/use-auth';

const ChallengesPage: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        heading="Challenges"
        subheading="Participate in challenges to earn points and unlock achievements"
      />
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Challenges</TabsTrigger>
          <TabsTrigger value="my">My Challenges</TabsTrigger>
          <TabsTrigger value="group">Group Challenges</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ChallengesList filter="all" />
        </TabsContent>
        
        <TabsContent value="my">
          <UserChallenges userId={user?.id} />
        </TabsContent>
        
        <TabsContent value="group">
          <ChallengesList filter="group" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChallengesPage;