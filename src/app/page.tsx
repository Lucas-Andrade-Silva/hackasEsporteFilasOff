import MovaApp from "@/components/mova-app";
export default function Home(){return <MovaApp view="home" privateCapture={process.env.ENABLE_PRIVATE_CAPTURE==="true"}/>}
