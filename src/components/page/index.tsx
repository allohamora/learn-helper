import { type FC } from 'react';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { FileText } from 'lucide-react';

const FEATURES = [
  {
    title: 'Article',
    description: 'Generate an article on the requested theme',
    href: '/article',
    Icon: FileText,
  },
];

export const IndexPage: FC = () => {
  return (
    <div className="flex items-center justify-center pt-10">
      <div className="flex flex-col items-center justify-center">
        <h1 className="pb-10 text-3xl">Welcome to Learn Assistant</h1>
        <div className="flex flex-wrap items-center justify-center space-x-4">
          {FEATURES.map(({ title, description, href, Icon }) => (
            <a key={`${title}-${description}`} href={href}>
              <Card className="w-[300px] cursor-pointer transition-all hover:scale-105 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 pt-6">
                  <Icon className="size-12" />
                  <div>
                    <CardTitle className="mb-2">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
