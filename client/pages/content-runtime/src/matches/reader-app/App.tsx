import { Overlay } from './components/Overlay';

interface AppProps {
  destroyCallback: () => void;
}

export default function App({ destroyCallback }: AppProps) {
  return (
    <div className="app-container">
      <Overlay onDestroy={destroyCallback} />
    </div>
  );
}
