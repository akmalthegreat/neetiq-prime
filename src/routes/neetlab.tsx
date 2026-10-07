import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BookMarked, FlaskConical, Atom, Microscope } from "lucide-react";
// NEETLab is one of the heaviest areas (3D/simulation code). Keep it out of
// the initial route bundle and load each subject experience only when opened.
const SubjectIndex = lazy(() => import("@/neetlab/components/SubjectIndex").then((m) => ({ default: m.SubjectIndex })));
const BioTopic = lazy(() => import("@/neetlab/components/BiologyTopic").then((m) => ({ default: m.BioTopic })));
const PhyTopic = lazy(() => import("@/neetlab/components/PhysicsTopic").then((m) => ({ default: m.PhyTopic })));
const ChemTopic = lazy(() => import("@/neetlab/components/ChemistryTopic").then((m) => ({ default: m.ChemTopic })));
import { subjects } from "@/neetlab/data/topics";
import { FeatureLock } from "@/components/feature-lock";

export const Route = createFileRoute("/neetlab")({
  head: () => ({ meta: [{ title: "NEETLab — 3D Sims & PYQs" }] }),
  component: () => (<FeatureLock feature="neetlab"><NEETLabPage/></FeatureLock>),
});

function NEETLabPage() {
  const nav = useNavigate();
  const [bio, setBio] = useState<string | null>(null);
  const [phy, setPhy] = useState<string | null>(null);
  const [chem, setChem] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
        <Suspense fallback={<div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Loading NEETLab tools…</div>}>
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 text-white shadow-lg">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">NEETLab</h1>
            <p className="text-sm text-muted-foreground">3D models, physics simulations & NEET PYQs in one place.</p>
          </div>
          <Button variant="secondary" onClick={() => nav({ to: "/pyqs" })}>
            <BookMarked className="mr-2 h-4 w-4" /> Open PYQs
          </Button>
        </div>

        <Tabs defaultValue="biology" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="biology"><Microscope className="mr-1 h-4 w-4" /> Biology</TabsTrigger>
            <TabsTrigger value="physics"><Atom className="mr-1 h-4 w-4" /> Physics</TabsTrigger>
            <TabsTrigger value="chemistry"><FlaskConical className="mr-1 h-4 w-4" /> Chemistry</TabsTrigger>
            <TabsTrigger value="pyqs"><BookMarked className="mr-1 h-4 w-4" /> PYQs</TabsTrigger>
          </TabsList>

          <TabsContent value="biology">
            {bio ? <BioTopic topic={bio} /> : (
              <SubjectIndex subject="biology" title={subjects.biology.title} desc={subjects.biology.desc} topics={subjects.biology.topics as any} onPick={setBio} />
            )}
            {bio && <div className="mt-4"><Button variant="ghost" onClick={() => setBio(null)}>← Back to all topics</Button></div>}
          </TabsContent>

          <TabsContent value="physics">
            {phy ? <PhyTopic topic={phy} /> : (
              <SubjectIndex subject="physics" title={subjects.physics.title} desc={subjects.physics.desc} topics={subjects.physics.topics as any} onPick={setPhy} />
            )}
            {phy && <div className="mt-4"><Button variant="ghost" onClick={() => setPhy(null)}>← Back to all topics</Button></div>}
          </TabsContent>

          <TabsContent value="chemistry">
            {chem ? <ChemTopic topic={chem} /> : (
              <SubjectIndex subject="chemistry" title={subjects.chemistry.title} desc={subjects.chemistry.desc} topics={subjects.chemistry.topics as any} onPick={setChem} />
            )}
            {chem && <div className="mt-4"><Button variant="ghost" onClick={() => setChem(null)}>← Back to all topics</Button></div>}
          </TabsContent>

          <TabsContent value="pyqs">
            <div className="rounded-2xl border bg-card p-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">Open the full PYQ practice experience.</p>
              <Button onClick={() => nav({ to: "/pyqs" })}><BookMarked className="mr-2 h-4 w-4" /> Go to PYQs</Button>
            </div>
          </TabsContent>
        </Tabs>
        </Suspense>
      </main>
    </div>
  );
}
