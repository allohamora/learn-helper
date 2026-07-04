import { Button } from '#/components/ui/button';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: IndexPage });

function IndexPage() {
  return <Button>Hello!</Button>;
}
