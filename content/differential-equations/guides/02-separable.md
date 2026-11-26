---
title: Separable equations
summary: When dy/dx factors into a function of x times a function of y, separate and integrate.
order: 2
method: [separable, direct]
---

:::definition Separable equation
A first-order equation is **separable** if it can be written as
$$\frac{dy}{dx} = g(x)\,h(y).$$
:::

The idea is to get every $y$ on one side and every $x$ on the other, then integrate each side with respect to its own variable.

## The method

1. **Factor** the right side as $g(x)h(y)$.
2. **Separate**: divide by $h(y)$ and multiply by $dx$:
   $$\frac{1}{h(y)}\,dy = g(x)\,dx.$$
3. **Integrate both sides**, with one constant:
   $$\int \frac{dy}{h(y)} = \int g(x)\,dx + C.$$
4. **Solve for $y$** if you can. If not, the implicit equation is a perfectly good answer.
5. **Check for lost solutions**: if $h(y_0) = 0$, the constant function $y = y_0$ is a solution that step 2 divided away.

:::note Why is "multiplying by dx" allowed?
It is shorthand for the chain rule. If $H(y)$ is an antiderivative of $1/h(y)$, then $\frac{d}{dx}H(y(x)) = \frac{1}{h(y)}\frac{dy}{dx} = g(x)$, so integrating both sides with respect to $x$ gives exactly step 3.
:::

:::example Exponential growth
Solve $\dfrac{dy}{dx} = xy$.

**Solution.** Here $g(x) = x$ and $h(y) = y$. Separating gives $\frac{1}{y}\,dy = x\,dx$. Integrating,
$$\ln|y| = \frac{x^2}{2} + C.$$
Exponentiate: $|y| = e^C e^{x^2/2}$. Since $\pm e^C$ can be any nonzero constant, rename it $C$: $y = Ce^{x^2/2}$. The lost solution $y = 0$ is included when $C = 0$.
:::

```solve
y' = xy
```

:::example The logistic equation
Solve $y' = y(1 - y)$ with $y(0) = \tfrac12$.

**Solution.** Separate and use partial fractions: $\dfrac{1}{y(1-y)} = \dfrac1y + \dfrac{1}{1-y}$. Integrating gives $\ln\left|\dfrac{y}{1-y}\right| = x + C$, so $\dfrac{y}{1-y} = Ce^x$. The initial condition gives $C = 1$, and solving for $y$:
$$y = \frac{e^x}{1 + e^x}.$$
The equilibria $y = 0$ and $y = 1$ are where $h(y) = y(1-y)$ vanishes.
:::

```solve
y' = y(1 - y), y(0) = 1/2
```

:::warning A common mistake
$y' = x + y$ is **not** separable: a sum cannot be written as $g(x)h(y)$. (It is linear, though.)
:::

:::exercise
Solve $y' = e^{x + y}$. *Hint:* $e^{x+y} = e^x e^y$.
:::

:::solution
Separate: $e^{-y}\,dy = e^x\,dx$. Integrate: $-e^{-y} = e^x + C$, so $y = -\ln(-e^x - C)$, valid where $-e^x - C > 0$.
:::
