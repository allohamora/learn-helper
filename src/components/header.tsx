import { type FC } from 'react';
import { BarChart, Book, User } from 'lucide-react';
import { Link, useRouter } from '@tanstack/react-router';
import { authClient } from '@/services/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header: FC = () => {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleLogout = async () => {
    await authClient.signOut();
    await router.navigate({ to: '/' });
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 justify-between md:justify-start">
        <div className="flex items-center space-x-2 md:space-x-6">
          <Link to="/" className="flex items-center p-2 md:space-x-2 md:p-0">
            <img src="/favicon.svg" alt="Learn Helper Logo" className="size-6" aria-hidden="true" />
            <span className="sr-only font-bold md:not-sr-only md:inline">Learn Helper</span>
          </Link>

          <Link
            to="/vocabulary-lists"
            className="flex flex-col items-center p-2 text-foreground transition-colors hover:text-primary md:flex-row md:space-x-2 md:p-0"
          >
            <Book className="size-5 md:size-4" aria-hidden="true" />
            <span className="sr-only text-xs md:not-sr-only md:inline md:text-sm">Vocabulary Lists</span>
          </Link>

          <Link
            to="/statistics"
            className="flex flex-col items-center p-2 text-foreground transition-colors hover:text-primary md:flex-row md:space-x-2 md:p-0"
          >
            <BarChart className="size-5 md:size-4" aria-hidden="true" />
            <span className="sr-only text-xs md:not-sr-only md:inline md:text-sm">Statistics</span>
          </Link>
        </div>

        <div className="flex items-center md:ml-auto">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors outline-none hover:text-primary"
                aria-label="Profile menu"
              >
                <Avatar size="sm">
                  <AvatarImage src={session.user.image ?? undefined} alt={session.user.name} />
                  <AvatarFallback>{session.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-34">
                <DropdownMenuLabel className="truncate">{session.user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleLogout()}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:text-primary"
              aria-label="Log in"
            >
              <User className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};
