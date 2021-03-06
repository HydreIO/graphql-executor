import { stripIgnoredCharacters } from 'graphql/index.mjs'

const no_client = () => {
  throw new Error('Missing client')
}

export default (client = no_client()) => async (query, variables = {}) => {
  if (typeof query !== 'string') throw new Error('The query is not a String')

  const document = stripIgnoredCharacters(query)
  const bytes = [
    ...JSON.stringify({
      document,
      variables,
    }),
  ].map(c => c.charCodeAt(0))
  const uint16 = new Uint16Array(bytes)
  const uint8 = new Uint8Array(
      uint16.buffer,
      uint16.byteOffset,
      uint16.byteLength,
  )
  const channel = await client.open_channel()

  return {
    async *listen() {
      await channel.write(uint8)
      for await (const chunk of channel.read) {
        const buffer = new Uint16Array(chunk.buffer)
        const string = String.fromCharCode.apply(undefined, buffer)

        yield JSON.parse(string)
        /* c8 ignore next 2 */
        // not reachable
      }
    },
    // eslint-disable-next-line consistent-return
    async once() {
      await channel.write(uint8)
      for await (const chunk of channel.read) {
        const buffer = new Uint16Array(chunk.buffer)
        const string = String.fromCharCode.apply(undefined, buffer)

        channel.close()
        return JSON.parse(string)
      }
    },
    stop: () => {
      channel.close()
    },
  }
}
