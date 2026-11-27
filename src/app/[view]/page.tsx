import {notFound} from "next/navigation";
import MovaApp from "@/components/mova-app";
const views=["missions","capture","demo","results","passport","leaderboard","lab","privacy"] as const;
export default async function Screen({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<{sport?:string}>}){
  const {view}=await params;const {sport}=await searchParams;
  if(!views.includes(view as typeof views[number]))notFound();
  return <MovaApp key={view+sport} view={view} initialSport={sport==="basketball"?"basketball":"volleyball"} privateCapture={process.env.ENABLE_PRIVATE_CAPTURE==="true"}/>;
}
