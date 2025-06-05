import React from 'react';
import { useParams, useLocation } from 'wouter';
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from '@/hooks/use-auth';
import ChallengeDetail from '../components/challenges/challenge-detail';

const ChallengePage: React.FC = () => {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  
  const challengeId = params?.id ? parseInt(params.id, 10) : undefined;
  
  if (!challengeId) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-red-500">Invalid challenge ID</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        heading="Challenge Details"
        subheading="View challenge information and track your progress"
      />
      
      <ChallengeDetail 
        challengeId={challengeId} 
        userId={user?.id}
        onBack={() => navigate('/challenges')}
      />
    </div>
  );
};

export default ChallengePage;