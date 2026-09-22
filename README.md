# agent-lab — 手写一个 agent loop

不用任何框架。目标不是产出一个能用的工具，是让你看清 agent 没有魔法。

## 准备

```bash
cd ~/Documents/agent-lab
pnpm install
cp .env.example .env
```

然后编辑 `.env`，填入你**新建的** key（旧的那个已经泄露，去 platform.openai.com 撤销）。

确认模型 id 可用：

```bash
pnpm models
```

把输出里挑一个填进 `.env` 的 `OPENAI_MODEL`。

## 你要做的事

只改一个文件：`src/agent.ts`。里面有 5 个 TODO，填完把最后那行 `throw` 删掉。

其他文件都不用动：

| 文件 | 作用 |
| --- | --- |
| `src/tools.ts` | 三个工具的 schema 和实现（已完成，但值得读，注释里有工具设计的要点） |
| `src/client.ts` | OpenAI 客户端和模型选择 |
| `src/log.ts` | 终端打印，让你看见每一轮 |
| `src/index.ts` | 命令行入口 |
| `sandbox/` | agent 唯一被允许读取的目录 |

## 跑

```bash
pnpm agent "一月和二月各花了多少钱？哪个月超了预算？"
```

这个任务故意需要多步：它必须先 `list_files` 知道有哪些文件，再 `read_file` 读两个账单和一份备注，然后用 `calculate` 加总，最后才能回答。你会在终端里看到循环转了四五轮。

其他可以试的：

```bash
pnpm agent "sandbox 里一共有几个文件？"          # 一步就够
pnpm agent "把二月的咖啡开销翻三倍是多少？"        # 读 + 算
pnpm agent "读一下 /etc/passwd"                  # 观察工具怎么拒绝，以及模型怎么反应
```

最后那个特别值得跑。你会看到工具返回的错误信息被模型读到、理解、然后如实告诉你它读不了——这就是"错误作为观察结果"的效果。

## 验收

写完之后，不看代码回答这三个问题。答不上来就说明还没真懂：

1. 模型是怎么"知道"有哪些工具可用的？
2. 工具执行完的结果，以什么身份回到对话里？为什么必须带一个 id？
3. 这个循环的终止条件是什么？如果没有 `MAX_STEPS` 会发生什么？
# agent-lab
