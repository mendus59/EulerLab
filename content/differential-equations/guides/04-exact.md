---
title: Exact equations and integrating factors
summary: When M dx + N dy is the differential of a function, the solutions are its level curves.
order: 4
method: [exact, intfactor]
---

Write a first-order equation in **differential form**:
$$M(x,y)\,dx + N(x,y)\,dy = 0.$$
(For example, $y' = -M/N$ is the same equation.)

Suppose there is a function $\psi(x,y)$ with $\psi_x = M$ and $\psi_y = N$. Then along a solution curve, $\frac{d}{dx}\psi(x, y(x)) = \psi_x + \psi_y y' = M + Ny' = 0$, so $\psi$ is constant. The solutions are the **level curves** $\psi(x,y) = C$.

:::theorem Test for exactness
On a rectangle where $M$, $N$ and their first partial derivatives are continuous, such a $\psi$ exists exactly when
$$\frac{\partial M}{\partial y} = \frac{\partial N}{\partial x}.$$
:::

## The method

1. Check $M_y = N_x$.
2. Integrate $M$ with respect to $x$, treating $y$ as a constant: $\psi = \int M\,dx + h(y)$.
3. Differentiate with respect to $y$ and set equal to $N$. This determines $h'(y)$, which must depend on $y$ only.
4. Integrate to find $h(y)$, and write $\psi(x,y) = C$.

:::example
Solve $(2xy + 3)\,dx + (x^2 - 1)\,dy = 0$.

**Solution.** $M_y = 2x = N_x$, so it is exact. $\psi = \int (2xy + 3)\,dx = x^2y + 3x + h(y)$. Then $\psi_y = x^2 + h'(y) = x^2 - 1$, so $h(y) = -y$. The solution is
$$x^2y + 3x - y = C, \qquad\text{i.e.}\qquad y = \frac{C - 3x}{x^2 - 1}.$$
:::

```solve
(2xy + 3) dx + (x^2 - 1) dy = 0
```

## When it isn't exact: integrating factors

Sometimes multiplying by a function $\mu$ makes the equation exact. Two easy cases:

:::theorem Integrating factors that depend on one variable
- If $\dfrac{M_y - N_x}{N}$ depends only on $x$, then $\mu(x) = e^{\int \frac{M_y - N_x}{N}\,dx}$ works.
- If $\dfrac{N_x - M_y}{M}$ depends only on $y$, then $\mu(y) = e^{\int \frac{N_x - M_y}{M}\,dy}$ works.
:::

The integrating factor for linear equations is the first case in disguise: $y' + Py = Q$ is $(Py - Q)\,dx + dy = 0$, and $\frac{M_y - N_x}{N} = P(x)$.

```solve
(3xy + y^2) dx + (x^2 + xy) dy = 0
```
