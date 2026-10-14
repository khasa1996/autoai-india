import type { Metadata } from 'next';
import { Shell } from '../components/Shell';
import './globals.css';
export const metadata: Metadata = {title:{default:'AutoAI India — Find your next chapter',template:'%s | AutoAI India'},description:'An independent automotive platform. Explore reviewed vehicle information, plan your budget and find a clearer road to your next car.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body><Shell>{children}</Shell></body></html>}
