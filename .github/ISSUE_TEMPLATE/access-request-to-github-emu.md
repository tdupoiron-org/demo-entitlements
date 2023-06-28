---
name: New repository request
title: "New repository request"
description: Request a new corporate repository

labels: [new-repository-request]

body:
  - type: markdown
    attributes:
      value: |
        ### Create a new corporate repository for Axa development team

  - type: dropdown
    attributes:
      label: "Repository visibility"
      description: The visibility of the newly created repository,
      options:
        - public
        - internal
        - private
    validations:
      required: true

  - type: input
    attributes:
      label: "Repository name"
      description: The name of the repository to be created
      placeholder: repository name
    validations:
      required: true
