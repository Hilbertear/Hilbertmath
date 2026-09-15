---
title: "导数之间的控制关系"
date: "2025-03-04"
description: "由高阶导数的极限谈到泰勒展开、范德蒙行列式与 Poincaré 不等式。"
tags:
  - 数学随想
  - 数学分析
comments: true
comment_id: "math-2025-03-04-controlling-derivatives"
---

# 导数之间的控制关系

<p class="hm-meta"><time datetime="2025-03-04">2025 年 3 月 4 日</time><span>数学随想</span></p>

近期同学们都在为了夏令营考试刷数分、高代，我也整理一些内容。

首先是一道经典题目。设 $f(x)$ 在 $(a,+\infty)$ 上 $n$ 阶可导，若

$$
\lim_{x\to+\infty}f(x),
\qquad
\lim_{x\to+\infty}f^{(n)}(x)
$$

都存在且有限，则

$$
\lim_{x\to+\infty}f^{(k)}(x)=0,
\qquad k=1,2,\ldots,n.
$$

此题解决过程分两步。第一步是说明各阶导数极限的存在性，可以利用如下逻辑：

$$
\text{泰勒展开}
\longrightarrow \text{范德蒙行列式}
\longrightarrow \text{各阶导数有界}
\longrightarrow \text{各阶导数一致连续}.
$$

再利用“$f(x)$ 有极限，$f'$ 一致连续，则 $f'$ 有极限”，推出各阶导数的极限存在。

第二步比较简单，利用范德蒙行列式说明极限是零。

然后是 Poincaré 不等式，大概是指在适当的边界条件或归一化条件下，Sobolev 函数的 $L^p$ 范数可以被梯度控制。丘赛曾经考过 Poincaré 不等式的最优常数问题，记录如下：在 $\mathbb{R}^n$ 的有界区域 $\Omega$ 上，对 $u\in H_0^1(\Omega)$ 证明

$$
\int_\Omega u^2(x)\,dx
\leq C\int_\Omega |\nabla u|^2(x)\,dx.
$$

如果 $\Omega=(0,a)\times(0,b)$，证明

$$
C\geq\frac{a^2b^2}{\pi^2(a^2+b^2)}.
$$
