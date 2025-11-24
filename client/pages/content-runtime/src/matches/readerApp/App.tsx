import { ReaderPanel } from './gui/ReaderPanel';

interface AppProps {
  destroyCallback: () => void;
}

export default function App({ destroyCallback }: AppProps) {
  return (
    <div className="app-container">
      <ReaderPanel onDestroy={destroyCallback} />
    </div>
  );
}
