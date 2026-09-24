import { Command, Option } from "commander"
import { describe, expect, it } from "vitest"
import { annotate, describeOptions, describeProgram } from "../commands/index.js"
import { formatSuggestions, suggest } from "./index.js"

const program = () => {
  const root = new Command("tool").option("--json", "print JSON").option("--timeout <duration>", "give up after")
  const chats = root.command("chats").description("the chats")
  chats
    .command("list")
    .description("list chats")
    .option("--kind <dialog|group|channel>", "only this kind")
    .addOption(new Option("--sort <order>", "order").choices(["new", "old"]))
  const messages = root.command("messages").description("messages")
  messages.command("list").description("read a chat").argument("<chat>", "chat").option("--limit <n>", "how many")
  messages.command("send").description("send").argument("<chat>", "chat").argument("[text]", "what to say")
  annotate(root.command("legacy").description("old"), { state: "deprecated" })
  root.addCommand(new Command("complete"), { hidden: true })
  return root
}

const values = (words: string[], sources = {}) => {
  const root = program()
  return suggest({ commands: describeProgram(root), globalOptions: describeOptions(root), words, sources }).map(
    ({ value }) => value,
  )
}

const chatNames = { arguments: { chat: () => ["Family", { value: "Work", description: "group" }] } }

describe("suggest", () => {
  it("offers the top-level commands, leaving out hidden and deprecated ones", () => {
    expect(values([""])).toEqual(["chats", "messages"])
    expect(values(["me"])).toEqual(["messages"])
  })

  it("offers the actions of a resource", () => {
    expect(values(["messages", ""])).toEqual(["list", "send"])
  })

  it("offers an argument's values from the source the CLI hands in", () => {
    expect(values(["messages", "list", ""], chatNames)).toEqual(["Family", "Work"])
    expect(values(["messages", "list", "Fa"], chatNames)).toEqual(["Family"])
  })

  it("moves to the next argument once one is given", () => {
    expect(values(["messages", "send", "Family", ""], chatNames)).toEqual([])
  })

  it("offers the options of the command and the global ones", () => {
    expect(values(["messages", "list", "--"])).toEqual(["--limit", "--json", "--timeout"])
  })

  it("offers the values of an option, from choices or from its flags", () => {
    expect(values(["chats", "list", "--sort", ""])).toEqual(["new", "old"])
    expect(values(["chats", "list", "--kind", "g"])).toEqual(["group"])
    expect(values(["chats", "list", "--kind=ch"])).toEqual(["--kind=channel"])
  })

  it("steps over an option's value when walking to the word being typed", () => {
    expect(values(["--timeout", "30s", "messages", ""])).toEqual(["list", "send"])
    expect(values(["messages", "list", "--limit", "5", ""], chatNames)).toEqual(["Family", "Work"])
  })

  it("offers extra first words, such as profile names, only at the top", () => {
    const sources = { firstWord: () => ["personal"] }
    expect(values([""], sources)).toEqual(["chats", "messages", "personal"])
    expect(values(["chats", ""], sources)).toEqual(["list"])
  })
})

describe("formatSuggestions", () => {
  it("writes value<TAB>description lines and ends with the directive", () => {
    expect(formatSuggestions([{ value: "chats", description: "the chats" }])).toBe("chats\tthe chats\n:4")
    expect(formatSuggestions([])).toBe(":4")
  })
})
