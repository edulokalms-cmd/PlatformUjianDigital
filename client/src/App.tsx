import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Biodata from "@/pages/Biodata";
import Instructions from "@/pages/Instructions";
import Exam from "@/pages/Exam";
import Result from "@/pages/Result";
import AdminDashboard from "@/pages/AdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/biodata" component={Biodata} />
      <Route path="/instructions" component={Instructions} />
      <Route path="/exam" component={Exam} />
      <Route path="/result/:id" component={Result} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
