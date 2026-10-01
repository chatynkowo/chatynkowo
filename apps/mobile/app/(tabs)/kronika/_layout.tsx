import { TabStack } from '../../../src/ui'

/* The Kronika tab's own stack: the collection under a standard title. The
   title is the reward config's treasury title, so index.tsx sets it with
   Stack.Screen once the content is known. */
export default function KronikaLayout() {
  return <TabStack />
}
