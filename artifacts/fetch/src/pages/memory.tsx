import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemoryPanel } from "@/components/memory-panel";
import { Plus } from "lucide-react";

export default function MemoryPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Memory</h1>
        <p className="text-muted-foreground mt-1">Little notes Fetch keeps about you to make better suggestions. Edit anytime.</p>
      </header>

      <Card className="border-card-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Memory facts</CardTitle>
        </CardHeader>
        <CardContent>
          <MemoryPanel />
        </CardContent>
      </Card>
    </div>
  );
}
