import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowUp } from 'lucide-react';
import { Input } from './ui/input';
import type { FC } from 'react';

const FormSchema = z.object({
  topic: z.string().min(3).max(1000),
});

export type TopicFormProps = {
  onSubmit: (data: z.infer<typeof FormSchema>) => void;
};

export const TopicForm: FC<TopicFormProps> = ({ onSubmit }) => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    mode: 'onSubmit',
    defaultValues: {
      topic: '',
    },
  });

  return (
    <div className="flex items-center justify-center pt-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-[500px]">
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <div className="space-y-5">
                  <FormLabel className="block text-center text-3xl">Topic</FormLabel>
                  <div className="flex space-x-2 rounded-md">
                    <FormControl>
                      <Input
                        placeholder="What do you want to know?"
                        className="min-w-[300px] resize-none ring-0"
                        {...field}
                      />
                    </FormControl>
                    <Button className="rounded-md" variant="outline" size="icon" type="submit">
                      <ArrowUp />
                    </Button>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
};
