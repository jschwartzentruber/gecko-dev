/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MustOverrideChecker_h__
#define MustOverrideChecker_h__

#include "plugin.h"

class MustOverrideChecker : public BaseCheck {
public:
  MustOverrideChecker(StringRef CheckName, ContextType *Context = nullptr)
      : BaseCheck(CheckName, Context), CI(nullptr) {}
  void registerMatchers(MatchFinder *AstMatcher) override;
  void registerCompilerInstance(CompilerInstance &CI) override;
  void check(const MatchFinder::MatchResult &Result) override;

private:
  const CompilerInstance *CI;
};

#endif
