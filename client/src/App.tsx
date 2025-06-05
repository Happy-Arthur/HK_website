import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import AuthDebugPage from "@/pages/auth-debug";
import CommunityPage from "@/pages/community-page";
import ProfileSetupPage from "@/pages/profile-setup-page";
import ProfilePage from "@/pages/profile-page";
import UserProfilePage from "@/pages/user-profile-page";
import SettingsPage from "@/pages/settings-page";
import CreateEventPage from "@/pages/create-event-page";
import CreateGroupEventPage from "@/pages/create-group-event-page";
import EventPage from "@/pages/event-page";
import GroupEventPage from "@/pages/group-event-page";
import AdminPage from "@/pages/admin-page";
import AdminSetupPage from "@/pages/admin-setup-page";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminLoginPage from "@/pages/admin-login";
import TestLoginPage from "@/pages/test-login";
import GroupPage from "@/pages/group-page";
import ConnectionsPage from "@/pages/connections-page";
import AchievementsPage from "@/pages/achievements-page";
import ChallengesPage from "@/pages/challenges-page";
import ChallengePage from "@/pages/challenge-page";
import AchievementsAdminPage from "@/pages/admin/achievements-admin-page";
import { ProtectedRoute, AdminProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { TestAuth } from "./components/test-auth";
import TokenRefresher from "./components/auth/token-refresher";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/community" component={CommunityPage} />
      <ProtectedRoute path="/profile-setup" component={ProfileSetupPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/users/profile/:id" component={UserProfilePage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/events/create" component={CreateEventPage} />
      <ProtectedRoute path="/events/:id" component={EventPage} />
      <ProtectedRoute path="/groups/:groupId/create-event" component={CreateGroupEventPage} />
      <ProtectedRoute path="/groups/:groupId/events/:eventId" component={GroupEventPage} />
      <ProtectedRoute path="/groups/:id" component={GroupPage} />
      <ProtectedRoute path="/connections" component={ConnectionsPage} />
      <ProtectedRoute path="/achievements" component={AchievementsPage} />
      <AdminProtectedRoute path="/admin" component={AdminPage} />
      <AdminProtectedRoute path="/admin/dashboard" component={AdminDashboard} />
      <AdminProtectedRoute path="/admin/achievements" component={AchievementsAdminPage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/admin-setup" component={AdminSetupPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth-debug" component={AuthDebugPage} />
      <Route path="/test-auth" component={() => <TestAuth />} />
      <Route path="/test-login" component={TestLoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="app-container">
        <TokenRefresher />
        <Router />
        <Toaster />
      </div>
    </AuthProvider>
  );
}

export default App;
