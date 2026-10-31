import type { FC } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/services/auth';

const formSchema = z.object({
  email: z.email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

export const LoginForm: FC = () => {
  const router = useRouter();

  const form = useForm({
    defaultValues: { email: '', password: '' } as z.input<typeof formSchema>,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email(value);

      if (error) {
        toast.error(error.message ?? 'Failed to log in');
        return;
      }

      await router.navigate({ to: '/' });
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <div className="space-y-1">
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors[0]?.message}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="space-y-1">
            <Input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">{field.state.meta.errors[0]?.message}</p>
            )}
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
