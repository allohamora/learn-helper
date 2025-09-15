import { useState, type FC } from 'react';
import { actions } from 'astro:actions';
import { Button } from './ui/button';

export const CheckAuth: FC = () => {
  const [value, setValue] = useState<string>();

  const checkAuth = async () => {
    const { data, error } = await actions.getCurrentUser();
    if (error) {
      setValue(error.message);
    } else {
      setValue(`${data?.firstName} ${data?.lastName}`);
    }
  };

  return <div>{value ? <p>Current user: {value}</p> : <Button onClick={checkAuth}>Check Current User</Button>}</div>;
};
