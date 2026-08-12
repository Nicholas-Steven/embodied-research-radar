# Maintenance notes

1. 先修改`config/`，再运行`python scripts/update_radar.py --no-ai --threshold 45`。
2. 运行`python -m unittest discover -s tests -v`和`python scripts/build_site.py`。
3. 查看`data/papers.json`的`candidate_count`、`retained_count`与低相关样本，确认阈值没有把方向性论文全部过滤。
4. 不要把API Key、GitHub Token、付费PDF或未经许可的论文图片提交到仓库。
5. 事实字段需要来源链接；AI字段如果无法核验应写`Pending`或明确说明“无法从摘要确认”。
6. 若增加ABCD定义，请在`config/topics.json`和文档中注明来源与版本，不要凭记忆补写。

提交前最小检查：

```bash
python -m unittest discover -s tests -v
python -m py_compile scripts/radar/*.py scripts/*.py
python scripts/update_radar.py --no-ai --threshold 45
python scripts/build_site.py
```
