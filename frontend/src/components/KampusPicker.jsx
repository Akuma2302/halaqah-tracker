import ComboBox from './ComboBox';
import { INSTITUTIONS } from '../features/pastyear/institutions';

// A dropdown of the universities, colleges and matriculation centres in
// Malaysia that narrows as you type. A place that isn't listed (a branch
// campus, say) can still be typed in and kept as it is.
export default function KampusPicker({ placeholder = 'Choose or type your kampus', ...props }) {
  return <ComboBox groups={INSTITUTIONS} placeholder={placeholder} {...props} />;
}
