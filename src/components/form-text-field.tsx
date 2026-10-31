import type { ComponentProps, FC } from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';

type FormTextFieldProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & { field: AnyFieldApi };

export const FormTextField: FC<FormTextFieldProps> = ({ field, ...props }) => (
  <div className="space-y-1">
    <Input {...props} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
    {field.state.meta.errors.length > 0 && (
      <p className="text-sm text-destructive">{field.state.meta.errors[0]?.message}</p>
    )}
  </div>
);
