import DspyPlayground from '@/components/DspyPlayground';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DSPy - Vane',
  description: 'Run user-defined DSPy functions in Vane.',
};

const DspyPage = () => {
  return <DspyPlayground />;
};

export default DspyPage;
