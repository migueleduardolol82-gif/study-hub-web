import {notFound} from 'next/navigation';
import AvatarWardrobeLab from '@/components/avatar-wardrobe-lab';
export default function Page(){
 if(process.env.NODE_ENV!=='development')notFound();
 return <AvatarWardrobeLab/>;
}
