---
title: Linear first-order equations
summary: Put the equation in standard form, multiply by an integrating factor, and the left side becomes a product rule.
order: 3
method: [linear]
---

:::definition Standard form
A first-order linear equation can always be written as
$$y' + P(x)\,y = Q(x).$$
If the equation starts as $a(x)y' + b(x)y = c(x)$, divide by $a(x)$ first.
:::

## The key idea

The left side $y' + Py$ *almost* looks like the derivative of a product. If we multiply by a cleverly chosen function $\mu(x)$,
$$\mu y' + \mu P y,$$
we want this to equal $(\mu y)' = \mu y' + \mu' y$. That happens exactly when $\mu' = P\mu$, whose solution is

:::theorem Integrating factor
$$\mu(x) = e^{\int P(x)\,dx}.$$
Multiplying $y' + Py = Q$ by $\mu$ turns it into $\dfrac{d}{dx}\big[\mu(x)\,y\big] = \mu(x)\,Q(x)$.
:::

## The method

1. Write the equation in **standard form** and read off $P$ and $Q$.
2. Compute $\mu = e^{\int P\,dx}$. (No constant is needed, and you may drop absolute values.)
3. Rewrite as $(\mu y)' = \mu Q$.
4. **Integrate**: $\mu y = \int \mu Q\,dx + C$.
5. **Divide** by $\mu$.

:::example
Solve $y' + 2y = e^x$.

**Solution.** $P = 2$, so $\mu = e^{2x}$. Then $(e^{2x}y)' = e^{3x}$, and integrating gives $e^{2x}y = \tfrac13 e^{3x} + C$. Therefore
$$y = \tfrac13 e^x + Ce^{-2x}.$$
:::

```solve
y' + 2y = e^x
```

:::example Dividing first
Solve $xy' + y = x^2$ for $x > 0$.

**Solution.** Divide by $x$: $y' + \tfrac1x y = x$. Then $\mu = e^{\ln x} = x$, and $(xy)' = x^2$. So $xy = \tfrac{x^3}{3} + C$ and $y = \tfrac{x^2}{3} + \tfrac{C}{x}$.

(Notice the original left side $xy' + y$ was already $(xy)'$, so this equation is also *exact*.)
:::

```solve
x y' + y = x^2
```

:::tip The structure of the answer
The solution always has the form $y = y_p + Cy_h$: one particular solution plus a multiple of $y_h = 1/\mu$, which solves the homogeneous equation $y' + Py = 0$. You'll see the same pattern again for second-order linear equations.
:::
