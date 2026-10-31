import type { FC } from 'react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormTextField } from '@/components/form-text-field';
import { authClient } from '@/services/auth';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.email('Enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const RegisterForm: FC = () => {
  const router = useRouter();

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' } as z.input<typeof formSchema>,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: formSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signUp.email(formSchema.parse(value));

      if (error) {
        toast.error(error.message ?? 'Failed to sign up');
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
      <form.Field name="name">
        {(field) => <FormTextField field={field} placeholder="Name" aria-label="Name" autoComplete="name" />}
      </form.Field>

      <form.Field name="email">
        {(field) => (
          <FormTextField field={field} type="email" placeholder="Email" aria-label="Email" autoComplete="email" />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormTextField
            field={field}
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="new-password"
          />
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing up…' : 'Sign up'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
