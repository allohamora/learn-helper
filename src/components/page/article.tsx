import { useState, type FC } from 'react';
import { TopicForm } from '../topic-form';
import { actions } from 'astro:actions';
import { marked } from 'marked';
import { Loader } from '../ui/loader';
import 'github-markdown-css';

export const Article: FC = () => {
  const [article, setArticle] = useState<string>();
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <TopicForm
        onSubmit={async ({ topic }) => {
          setLoading(true);
          const { data, error } = await actions.getArticle(topic);
          setLoading(false);

          if (error) {
            setArticle(`# Error \n${error.message}`);
          } else {
            setArticle(data);
          }
        }}
      />
      {loading ? (
        <Loader className="mt-5 justify-center" />
      ) : article ? (
        <div
          className="markdown-body rounded-md border p-5 [&.markdown-body]:m-5 [&.markdown-body]:bg-inherit"
          dangerouslySetInnerHTML={{ __html: marked(article) }}
        />
      ) : null}
    </div>
  );
};
